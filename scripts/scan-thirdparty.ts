import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

async function main() {
  const files = await glob("src/**/*.{ts,tsx,js,jsx,css}", { absolute: true });
  console.log(`Scanning ${files.length} files...`);

  const patterns = [
    "userway",
    "accessibe",
    "widget",
    "toolbar",
    "accessibility",
    "iframe",
    "inject",
    "script",
    "google-analytics",
    "vercel/analytics",
    "vercel/speed-insights"
  ];

  for (const file of files) {
    if (file.includes("node_modules")) continue;
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      patterns.forEach(pattern => {
        if (line.toLowerCase().includes(pattern) && !file.includes("scan-styles") && !file.includes("check-db")) {
          const relativePath = path.relative(process.cwd(), file);
          console.log(`${relativePath}:L${index + 1} (${pattern}) -> ${line.trim()}`);
        }
      });
    });
  }
}

main().catch(console.error);
