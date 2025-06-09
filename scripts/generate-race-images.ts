#!/usr/bin/env tsx

import fs from "fs";
import path from "path";

interface RaceData {
  name: string;
  description: string;
  subraces?: Array<{
    name: string;
    description: string;
  }>;
}

interface OpenAIImageResponse {
  data: Array<{
    b64_json: string;
  }>;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID;
const OPENAI_ORG_ID = process.env.OPENAI_ORG_ID;
const RACES_DIR = "/Users/silasrhyneer/Code/heart-rush-tools/heart_rush/races";
const IMAGES_DIR =
  "/Users/silasrhyneer/Code/heart-rush-tools/heart_rush/races/images";
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT_COUNT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1]) : undefined;

if (!OPENAI_API_KEY && !DRY_RUN) {
  console.error(
    "OPENAI_API_KEY environment variable is required (or use --dry-run)"
  );
  process.exit(1);
}

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

async function generateImage(prompt: string, filename: string): Promise<void> {
  try {
    if (DRY_RUN) {
      console.log(`\n[DRY RUN] Would generate image for: ${filename}`);
      console.log(`Prompt: ${prompt}`);
      console.log(`Would save to: ${path.join(IMAGES_DIR, `${filename}.png`)}`);
      return;
    }

    console.log(`Generating image for: ${filename}`);
    console.log(`Prompt: ${prompt}`);

    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          ...(OPENAI_ORG_ID && { "OpenAI-Organization": OPENAI_ORG_ID }),
          ...(OPENAI_PROJECT_ID && { "OpenAI-Project": OPENAI_PROJECT_ID })
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: prompt,
          n: 1,
          size: "1024x1024",
          output_format: "png",
          quality: "high"
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data: OpenAIImageResponse = await response.json();
    const imageBase64 = data.data[0].b64_json;

    // Convert base64 to buffer and save as PNG
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const imagePath = path.join(IMAGES_DIR, `${filename}.png`);

    fs.writeFileSync(imagePath, imageBuffer);
    console.log(`✓ Saved image: ${imagePath}`);

    // Add delay to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (error) {
    console.error(`✗ Failed to generate image for ${filename}:`, error);
  }
}

function parseRaceFile(filePath: string): RaceData | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    // Get race name from first line
    const raceNameMatch = lines[0]?.match(/^## (.+)$/);
    if (!raceNameMatch) return null;

    const raceName = raceNameMatch[1];

    // Extract main race description (everything before first subrace)
    let description = "";
    let inDescription = false;
    let subraces: Array<{ name: string; description: string }> = [];
    let foundFirstSection = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Start collecting description after race name
      if (line.trim() === "" && !inDescription && !foundFirstSection) {
        inDescription = true;
        continue;
      }

      // Check for ### sections
      if (line.startsWith("### ")) {
        foundFirstSection = true;
        const sectionMatch = line.match(/^### (.+?)(?:\s*\(([^)]+)\))?$/);
        if (sectionMatch) {
          const sectionName = sectionMatch[1];

          // Skip common non-subrace sections (ability names, game mechanics, etc.)
          const nonSubraceSections = [
            "Vitals",
            "Aspects",
            "Natural Predator",
            "Hearty and Gruff",
            "Human Resilience and Diversity",
            "Years of Experience",
            "Cold-Blooded Metabolism",
            "Underfoot Advantage",
            "Forceborn",
            "Speechbroken",
          ];

          if (nonSubraceSections.includes(sectionName)) {
            // If we're still in description mode, stop collecting description
            if (inDescription) {
              inDescription = false;
            }
            continue;
          }

          // This is likely a subrace - collect its description
          let subraceDescription = "";
          let j = i + 1;

          // Collect description until next ### section or #### section
          while (j < lines.length && !lines[j].startsWith("###")) {
            const descLine = lines[j];

            // Skip #### sections (these are ability headers within subraces)
            if (descLine.startsWith("####")) {
              // Skip ahead past this #### section
              while (
                j < lines.length &&
                !lines[j + 1]?.startsWith("###") &&
                !lines[j + 1]?.startsWith("####")
              ) {
                j++;
              }
              j++; // Move past the last line of this section
              continue;
            }

            // Collect description text (skip bullet points and bold text)
            if (
              descLine.trim() &&
              !descLine.startsWith("**") &&
              !descLine.startsWith("-") &&
              !descLine.startsWith("* ")
            ) {
              subraceDescription += descLine + " ";
            }
            j++;
          }

          // Only add as subrace if we found a substantial description AND it looks like a cultural description, not an ability
          const desc = subraceDescription.trim();
          const hasAbilityMarkers =
            desc.includes("**Passive ability.**") ||
            desc.includes("**Major ability.**") ||
            desc.includes("**Heart ability.**") ||
            desc.includes("You gain") ||
            desc.includes("You have advantage") ||
            desc.includes("You can") ||
            desc.includes("You may") ||
            desc.includes("You are immune") ||
            desc.includes("Choose one:") ||
            desc.includes("When you") ||
            desc.includes("As an action") ||
            desc.includes("make a") ||
            desc.includes("take damage") ||
            desc.includes("roll") ||
            desc.includes("check");

          // Additional check: cultural descriptions typically mention society, culture, people, etc.
          const hasCulturalMarkers =
            desc.includes("society") ||
            desc.includes("culture") ||
            desc.includes("people") ||
            desc.includes("civilization") ||
            desc.includes("heritage") ||
            desc.includes("ancestors") ||
            desc.includes("tradition") ||
            desc.includes("community") ||
            desc.includes("bloodline") ||
            desc.includes("lineage") ||
            desc.includes("settlements") ||
            desc.includes("are known for") ||
            desc.includes("are the") ||
            desc.includes("have built") ||
            desc.includes("philosophy") ||
            desc.includes("belief") ||
            desc.includes("worship") ||
            desc.includes("dwell") ||
            desc.includes("live in");

          // Must have substantial description AND be cultural/lore text, not ability text
          if (
            desc &&
            desc.length > 200 &&
            !hasAbilityMarkers &&
            hasCulturalMarkers
          ) {
            subraces.push({
              name: sectionName,
              description: desc,
            });
          }

          // Stop collecting main description once we hit the first potential subrace
          if (inDescription) {
            inDescription = false;
          }
        }
      }

      // Collect main race description lines
      if (
        inDescription &&
        line.trim() &&
        !line.startsWith("**") &&
        !line.startsWith("-") &&
        !line.startsWith("* ")
      ) {
        description += line + " ";
      }
    }

    return {
      name: raceName,
      description: description.trim(),
      subraces: subraces.length > 0 ? subraces : undefined,
    };
  } catch (error) {
    console.error(`Error parsing file ${filePath}:`, error);
    return null;
  }
}

async function createImagePrompt(
  raceName: string,
  description: string
): Promise<string> {
  // Clean up description and create a focused prompt
  const cleanDescription = description
    .replace(/\s+/g, " ")
    .substring(0, 800) // Increase length for GPT processing
    .trim();

  // Randomly select gender
  const gender = Math.random() < 0.5 ? "male" : "female";

  const basicPrompt = `A fantasy RPG character portrait of a ${gender} ${raceName} from a tabletop role-playing game. ${cleanDescription}. Digital art style, detailed character design, fantasy setting, professional RPG artwork quality, front-facing portrait view, neutral background.`;

  if (DRY_RUN) {
    return basicPrompt; // Skip GPT processing in dry run
  }

  try {
    // Use GPT-4o-mini to improve the prompt
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        ...(OPENAI_ORG_ID && { "OpenAI-Organization": OPENAI_ORG_ID }),
        ...(OPENAI_PROJECT_ID && { "OpenAI-Project": OPENAI_PROJECT_ID })
      },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "system",
            content:
              "You are an expert at creating precise, detailed image generation prompts for fantasy RPG character art. Take the provided prompt and enhance it with specific visual details, art style specifications, and atmospheric elements while keeping the core description intact. Focus on physical appearance, clothing, pose, lighting, and artistic style. Keep it under 300 words.",
          },
          {
            role: "user",
            content: `Improve this image generation prompt for better visual results:\n\n${basicPrompt}`,
          },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.warn(
        `GPT-4o-mini prompt enhancement failed: ${response.status}. Using basic prompt.`
      );
      return basicPrompt;
    }

    const data = await response.json();
    const enhancedPrompt = data.choices[0]?.message?.content?.trim();

    if (enhancedPrompt) {
      console.log(`✓ Enhanced prompt with GPT-4o-mini`);
      return enhancedPrompt;
    } else {
      console.warn(`GPT-4o-mini returned empty response. Using basic prompt.`);
      return basicPrompt;
    }
  } catch (error) {
    console.warn(
      `GPT-4o-mini enhancement error: ${error}. Using basic prompt.`
    );
    return basicPrompt;
  }
}

async function main() {
  if (DRY_RUN) {
    console.log("=== DRY RUN MODE - No images will be generated ===");
  } else {
    console.log("Starting race image generation...");
  }

  // Get all race files
  const raceFiles = fs
    .readdirSync(RACES_DIR)
    .filter((file) => file.endsWith(".md"))
    .sort();

  let totalImages = 0;
  let totalRaces = 0;
  let totalSubraces = 0;
  let processedRaces = 0;

  for (const raceFile of raceFiles) {
    // Check if we should limit processing
    if (LIMIT_COUNT && processedRaces >= LIMIT_COUNT) {
      console.log(`\nReached limit of ${LIMIT_COUNT} races. Stopping.`);
      break;
    }
    const raceFilePath = path.join(RACES_DIR, raceFile);
    const raceData = parseRaceFile(raceFilePath);

    if (!raceData) {
      console.log(`Skipping ${raceFile} - could not parse`);
      continue;
    }

    totalRaces++;
    processedRaces++;
    console.log(`\n${"=".repeat(50)}`);
    console.log(
      `Processing: ${raceData.name} (${processedRaces}/${LIMIT_COUNT || "all"})`
    );
    console.log(`${"=".repeat(50)}`);

    // Check if main race image already exists
    const mainImagePath = path.join(IMAGES_DIR, `${raceData.name}.png`);
    if (!fs.existsSync(mainImagePath) || DRY_RUN) {
      const prompt = await createImagePrompt(
        raceData.name,
        raceData.description
      );
      await generateImage(prompt, raceData.name);
      if (!DRY_RUN) totalImages++;
    } else {
      console.log(`✓ Image already exists: ${raceData.name}.png`);
    }

    // Generate images for subraces
    if (raceData.subraces) {
      console.log(`\n  Found ${raceData.subraces.length} subraces:`);
      for (const subrace of raceData.subraces) {
        totalSubraces++;
        console.log(`  - ${subrace.name}`);

        const subraceImagePath = path.join(IMAGES_DIR, `${subrace.name}.png`);
        if (!fs.existsSync(subraceImagePath) || DRY_RUN) {
          const prompt = await createImagePrompt(
            `${subrace.name} ${raceData.name}`,
            `${subrace.description} This is a subrace of ${raceData.name}.`
          );
          await generateImage(prompt, subrace.name);
          if (!DRY_RUN) totalImages++;
        } else {
          console.log(`    ✓ Image already exists: ${subrace.name}.png`);
        }
      }
    } else {
      console.log(`  No subraces found.`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`SUMMARY:`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Total races: ${totalRaces}`);
  console.log(`Total subraces: ${totalSubraces}`);
  console.log(`Total images needed: ${totalRaces + totalSubraces}`);

  if (DRY_RUN) {
    console.log(
      `\n✓ Dry run complete! Found ${
        totalRaces + totalSubraces
      } races/subraces that would have images generated.`
    );
  } else {
    console.log(
      `\n✓ Image generation complete! Generated ${totalImages} new images.`
    );
  }
}

// Run the script
main().catch(console.error);
