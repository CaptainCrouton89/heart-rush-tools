import fs from "fs/promises";
import path from "path";

const RACES_IMAGES_DIR = "heart_rush/races/images";
const PUBLIC_IMAGES_DIR = "public/heart_rush/races/images";

export async function copyRaceImages(): Promise<void> {
  try {
    // Check if source images directory exists
    await fs.access(RACES_IMAGES_DIR);

    // Ensure public images directory exists
    await fs.mkdir(PUBLIC_IMAGES_DIR, { recursive: true });

    // Read all files in the source images directory
    const imageFiles = await fs.readdir(RACES_IMAGES_DIR);

    // Common image extensions
    const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

    // Copy each valid image file
    let copiedCount = 0;
    for (const imageFile of imageFiles) {
      const ext = path.extname(imageFile).toLowerCase();
      if (imageExtensions.includes(ext)) {
        const sourcePath = path.join(RACES_IMAGES_DIR, imageFile);
        const destPath = path.join(PUBLIC_IMAGES_DIR, imageFile);

        try {
          await fs.copyFile(sourcePath, destPath);
          copiedCount++;
        } catch (error) {
          console.warn(`Failed to copy ${imageFile}:`, error);
        }
      }
    }

    if (copiedCount > 0) {
      console.log(`✅ Copied ${copiedCount} race images to public directory`);
    }
  } catch (error) {
    // Directory doesn't exist - not a problem
    console.log("No race images directory found, skipping image copying");
  }
}

export async function findRaceImage(title: string): Promise<string | undefined> {
  try {
    // Check if images directory exists
    await fs.access(RACES_IMAGES_DIR);

    // Read all files in the images directory
    const imageFiles = await fs.readdir(RACES_IMAGES_DIR);

    // Common image extensions
    const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

    // Look for image file with matching name (case insensitive)
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");

    for (const imageFile of imageFiles) {
      const baseName = path.basename(imageFile, path.extname(imageFile));
      const normalizedBaseName = baseName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      if (
        normalizedBaseName === normalizedTitle &&
        imageExtensions.includes(path.extname(imageFile).toLowerCase())
      ) {
        return `/heart_rush/races/images/${imageFile}`;
      }
    }
  } catch (error) {
    // Directory doesn't exist or other error - not a problem
  }

  return undefined;
}