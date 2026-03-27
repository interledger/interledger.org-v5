import path from 'node:path'
import fs from 'fs/promises'
import type { SessionizeSpeaker } from '@/types/summit'
import { sessionizeApiMap, currentSummitYear, YEARS } from '@/utils/sessionize'
import { generateSlug } from '@/utils/slug'

//Step 0. Read YEAR from command-line arguments or defaults to currentSummitYear
const rawArgs = process.argv.slice(2)
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs

const YEAR = args[0] ?? currentSummitYear

if (!YEARS.includes(YEAR)) {
  console.error(
    `❌ Invalid YEAR: ${args[0]}. Must be one of: ${YEARS.join(', ')}`
  )
  process.exit(1)
}

console.log(`📅 Running import for YEAR: ${YEAR}`)

// Step 1: Import data from Sessionize into `src/data/` JSON files
const basePath = path.resolve(`./src/data/sessionize`)
await fs.mkdir(basePath, { recursive: true })

const { speakersUrl, talksUrl } = sessionizeApiMap[YEAR]
if (!speakersUrl || !talksUrl) {
  console.error(`❌ No Sessionize API URLs configured for YEAR ${YEAR}`)
  process.exit(1)
}

async function fetchAndSave(url: string, filePath: string, label: string) {
  try {
    const resp = await fetch(url)
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch ${label}; Status: ${resp.status} ${resp.statusText}`
      )
    }
    const data = await resp.json()

    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
    console.log(`✅ Saved ${label} JSON: ${filePath}`)
  } catch (err) {
    console.error(
      `❌ Error fetching ${label}:`,
      err instanceof Error ? err.message : err
    )
    process.exit(1)
  }
}

async function getSessionizeData(speakersUrl: string, talksUrl: string) {
  const speakersFile = path.join(basePath, `${YEAR}-speakers.json`)
  const talksFile = path.join(basePath, `${YEAR}-talks.json`)
  await Promise.all([
    fetchAndSave(speakersUrl, speakersFile, 'Speakers'),
    fetchAndSave(talksUrl, talksFile, 'Talks')
  ])
}

//Step 2: import Sessionize images into `/public/img/sessionize-speakers/{year}` folder
const imgUrlFileSource = path.join(basePath, `${YEAR}-speakers.json`)
const imgFilePath = path.resolve(`./public/img/sessionize-speakers/${YEAR}`)
await fs.mkdir(imgFilePath, { recursive: true })

async function fetchAndSaveImage(url: string, name: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image: ${url}; Status: ${response.status} ${response.statusText}`
      )
    }

    const ext = path.extname(new URL(url).pathname) || '.jpg'
    const filePath = path.join(imgFilePath, name + ext)

    const buffer = await response.arrayBuffer()

    await fs.writeFile(filePath, Buffer.from(buffer))
    console.log(`✅ Saved image: ${name}`)
  } catch (err) {
    console.error(
      `❌ Error fetching Sessionize image: ${name};`,
      err instanceof Error ? err.message : err
    )
  }
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

async function batchPromises<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>
) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(fn))
  }
}

async function getImageUrlsFromSessionize() {
  let speakersData: SessionizeSpeaker[] = []

  try {
    const rawData = await fs.readFile(imgUrlFileSource, 'utf-8')
    speakersData = JSON.parse(rawData)
  } catch (err) {
    console.error(
      `❌ Failed to read or parse speaker JSON for YEAR ${YEAR}:`,
      err instanceof Error ? err.message : err
    )
    process.exit(1)
  }

  await clearFolder(imgFilePath)

  await batchPromises(speakersData, 5, async (speaker) => {
    const sessionizeUrl = speaker.profilePicture
    if (!sessionizeUrl) {
      console.log(`⚠️ Missing image for speaker: ${speaker.fullName} `)
      return
    }
    const name = generateSlug(speaker.fullName)
    await fetchAndSaveImage(sessionizeUrl, name)
  })

  console.log(`✅ Finished downloading the images for the ${YEAR} speakers`)
}

await getSessionizeData(speakersUrl, talksUrl)
await getImageUrlsFromSessionize()
