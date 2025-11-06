import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import fs from "fs";
import path from "path";

export default defineConfig({
  build: {
    target: "esnext",
    cssCodeSplit: false,
  },
  plugins: [
    viteSingleFile(),
    {
      name: "rename-output-html",
      closeBundle() {
        const dist = "dist";
        const oldPath = path.join(dist, "index.html");
        const newPath = path.join(dist, "fuzzy-plates.html");
	
        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
          console.log("Renamed index.html → fuzzy-plates.html");
        }
      }
    }
  ],
});
