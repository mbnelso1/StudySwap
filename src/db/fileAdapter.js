// src/db/fileAdapter.js
import fs from "fs/promises";

export class FileAdapter {
  constructor(filename) {
    if (!filename) {
      throw new Error("FileAdapter requires a filename");
    }
    this.filename = filename;
  }

  // Load the JSON document from disk.
  // If the file doesn't exist yet, start with an empty object.
  async load() {
    try {
      const contents = await fs.readFile(this.filename, "utf8");
      return JSON.parse(contents);
    } catch (err) {
      if (err.code === "ENOENT") {
        // No file yet → start from an empty document
        return {};
      }
      throw err;
    }
  }

  // Save the JSON document to disk using an atomic write:
  // write to a temp file, then rename.
  async save(doc) {
    const tmp = this.filename + ".tmp";
    const json = JSON.stringify(doc, null, 2);

    await fs.writeFile(tmp, json, "utf8");
    await fs.rename(tmp, this.filename);
  }
}

