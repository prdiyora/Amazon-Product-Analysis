import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ZipArchive } from "archiver";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(root, "public", "downloads");
const outputPath = resolve(outputDirectory, "amazon-product-analysis-extension.zip");

mkdirSync(outputDirectory, { recursive: true });

const output = createWriteStream(outputPath);
const archive = new ZipArchive({ zlib: { level: 9 } });

const completed = new Promise((resolvePromise, rejectPromise) => {
  output.on("close", resolvePromise);
  output.on("error", rejectPromise);
  archive.on("error", rejectPromise);
});

archive.pipe(output);
archive.file(resolve(root, "manifest.json"), { name: "manifest.json" });
archive.file(resolve(root, "README.md"), { name: "README.md" });
archive.directory(resolve(root, "src"), "src");
archive.directory(resolve(root, "apps-script"), "apps-script");
await archive.finalize();
await completed;

console.log(`Extension ZIP created: ${outputPath}`);
