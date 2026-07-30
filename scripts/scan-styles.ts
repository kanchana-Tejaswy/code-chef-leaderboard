import * as fs from "fs";
import * as path from "path";

const filePath = path.resolve(process.cwd(), "src/app/leaderboard/page.tsx");
const content = fs.readFileSync(filePath, "utf-8");

const lines = content.split("\n");
console.log(`Scanning ${filePath} (${lines.length} lines):`);

const keywords = [
  "opacity",
  "disabled",
  "gray",
  "grey",
  "overlay",
  "bg-black/",
  "bg-zinc-",
  "bg-slate-",
  "pointer-events-",
  "backdrop",
  "inset-0",
  "brightness",
  "grayscale",
  "text-muted",
  "filter"
];

lines.forEach((line, index) => {
  const match = keywords.find(keyword => line.toLowerCase().includes(keyword.toLowerCase()));
  if (match) {
    console.log(`L${index + 1} (${match}): ${line.trim()}`);
  }
});
