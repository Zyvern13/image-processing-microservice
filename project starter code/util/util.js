import fs from "fs";
import os from "os";
import path from "path";
import https from "https";
import http from "http";
import Jimp from "jimp";


// filterImageFromURL
// helper function to download, filter, and save the filtered image locally
// returns the absolute path to the local image
// INPUTS
//    inputURL: string - a publicly accessible url to an image file
// RETURNS
//    an absolute path to a filtered image locally saved file
export async function filterImageFromURL(inputURL, redirects = 5) {
  return new Promise((resolve, reject) => {
    // Pick the right client based on the protocol.
    const client = inputURL.startsWith("http://") ? http : https;

    // Send a real User-Agent header. Some hosts (e.g. Wikimedia) reject
    // requests without one, which leaves Jimp with an empty/HTML body and
    // fails with "Could not find MIME for Buffer <null>".
    const options = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ImageFilterBot/1.0; +https://example.com)",
      },
    };

    client
      .get(inputURL, options, (response) => {
        const { statusCode, headers } = response;

        // Follow redirects (http.get/https.get do not do this automatically).
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          response.resume();
          if (redirects <= 0) {
            return reject(new Error("Too many redirects"));
          }
          return resolve(filterImageFromURL(headers.location, redirects - 1));
        }

        // Reject non-2xx responses cleanly instead of feeding Jimp bad data.
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          return reject(new Error(`Request failed. Status: ${statusCode}`));
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const photo = await Jimp.read(buffer);
            const outpath = path.join(
              os.tmpdir(),
              "filtered." + Math.floor(Math.random() * 2000) + ".jpg"
            );
            await photo
              .resize(256, 256) // resize
              .quality(60) // set JPEG quality
              .greyscale() // set greyscale
              .writeAsync(outpath);
            resolve(outpath);
          } catch (error) {
            reject(error);
          }
        });
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

// deleteLocalFiles
// helper function to delete files on the local disk
// useful to cleanup after tasks
// INPUTS
//    files: Array<string> an array of absolute paths to files
 export async function deleteLocalFiles(files) {
  for (let file of files) {
    fs.unlinkSync(file);
  }
}
