import * as requestPromise from 'request-promise';
import * as yargs from 'yargs';
import * as fs from 'fs';
import * as request from 'request';

if (
  !yargs.argv.blog ||
  !yargs.argv.outdir
) { process.exit(1); }
const pageUrl = (page = 0) => `https://${yargs.argv.blog}.tumblr.com/page/${page}`;

let nextPage = 0;
let lastStatus = undefined;

do {
  requestPromise(pageUrl(nextPage))
  	.then(createDataStructurePromise)
  	.then(extractImageUrls)
  	.then(extractVideoUrls)
  	.then(downloadAllMedia)
  	.then(() => {
  		 lastStatus = '';
  		 nextPage = nextPage + 1;
  	});
} while (lastStatus == 200);

type DataStructure = {
  html : string,
  mediaUrls: Array<string>
};

function createDataStructurePromise(body : string) : DataStructure {
	 return {
     html: body,
     mediaUrls: [],
   };
}

function extractImageUrls(struct : DataStructure) : Promise<DataStructure> {
  const imageUrlMatcher = (html : string) =>  html.match(/https:\/\/.*media\.tumblr\.com\/[^"'&]*/g);
  return Promise.resolve({
    ...struct,
    mediaUrls: [
      ...struct.mediaUrls,
      ...imageUrlMatcher(struct.html)
    ]
  });
}

function extractVideoUrls(struct : DataStructure) {
  const videoIframeUrlMatcher = (html : string) => html.match(/https:\/\/www\.tumblr\.com\/video\/[^"']*/g);
  const videoSrcUrlMatcher = (html : string) => html.match(/https:\/\/[^'"]*\.tumblr\.com\/video_file\/[^"']*/g);
  return Promise.all(
    videoIframeUrlMatcher(struct.html).map(
      iframeUrl => requestPromise(iframeUrl).catch(err => err.response.body)
    )
  ).then(iframeHtmls => iframeHtmls.map(html => videoSrcUrlMatcher(html)[0]))
  .then(videoUrls => ({
    ...struct,
    mediaUrls: [
      ...struct.mediaUrls,
      ...videoUrls
    ].filter(str => str != '' && str != null)
  }));
}

function downloadAllMedia(struct : DataStructure) {
  //return console.log(struct.mediaUrls);
  const getFilename = (url : string) => `${yargs.argv.outdir}/${url.replace(/\//g, '_')}`;
  struct.mediaUrls.forEach(
    url => {
      setTimeout(() =>
        request(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:57.0) Gecko/20100101 Firefox/57.0'
          }
        }).pipe(fs.createWriteStream(getFilename(url))),
        1000);
    }
  );
}
