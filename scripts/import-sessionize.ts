// Step 1: Import data from Sessionize into `src/data/` JSON files
// this is a phase 2 issue

import path from 'node:path'
import fs from 'fs/promises'
import type { SessionizeSpeaker } from '@/types/summit'
import { currentYear } from '@/utils/summit-talks-speakers'
import { generateSlug } from '@/utils/slug'

//Step 2: import Sessionize images into `/public/img/sessionize-speakers/{year}` folder

//read YEAR from command-line arguments
// or defaults to current year
const rawArgs = process.argv.slice(2)
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs

const YEAR = args[0] ? Number(args[0]) : currentYear
if (isNaN(YEAR)) {
  console.error(
    '❌ Invalid YEAR provided. Must be a number. E.g.: pnpm run sync:sessionize -- 2024'
  )
  process.exit(1)
}

console.log(`📅 Running import for YEAR: ${YEAR}`)

const imgUrlFileSource = path.resolve(
  `./src/data/sessionize/${YEAR}-speakers.json`
)
const imgFilePath = path.resolve(`./public/img/sessionize-speakers/${YEAR}`)

async function fetchSaveImage(url: string, name: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image: ${url}; Status: ${response.status} ${response.statusText}`
      )
    }

    const ext = path.extname(url) || '.jpg'
    const filePath = path.join(imgFilePath, name + ext)

    const buffer = await response.arrayBuffer()

    await fs.writeFile(filePath, Buffer.from(buffer))
  } catch (err) {
    if (err instanceof Error) {
      console.error(
        `❌ Error fetching Sessionize image: ${name}; ${err.message}`
      )
    } else {
      console.error(`❌ Error fetching Sessionize image: ${name};`, err)
    }
  }
  console.log(`✅ Saved image: ${name}`)
}

async function clearFolder(folderPath: string) {
  try {
    await fs.rm(folderPath, { recursive: true, force: true })
    await fs.mkdir(folderPath, { recursive: true })
    console.log(`🗑️ Cleared folder: ${folderPath}`)
  } catch (err) {
    console.error(`❌ Failed to clear folder: ${folderPath}`, err)
  }
}

async function getImageUrlsFromSessionize() {
  try {
    await fs.access(imgUrlFileSource)
  } catch {
    console.error(
      `❌ Speaker JSON not found for YEAR ${YEAR}: ${imgUrlFileSource}`
    )
    process.exit(1)
  }

  const rawData = await fs.readFile(imgUrlFileSource, 'utf-8')
  const speakersData: SessionizeSpeaker[] = JSON.parse(rawData)

  await clearFolder(imgFilePath)

  await Promise.all(
    speakersData.map(async (speaker) => {
      const sessionizeUrl = speaker.profilePicture
      if (!sessionizeUrl) {
        console.log(`⚠️ Could not find image for speaker: ${speaker.fullName} `)
        return
      }
      const name = generateSlug(speaker.fullName)
      await fetchSaveImage(sessionizeUrl, name)
    })
  )
  console.log(`✅ Finished downloading the images for the ${YEAR} speakers`)
}

getImageUrlsFromSessionize()
