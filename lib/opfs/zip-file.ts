import JSZip from "jszip"

import { getDirHandle, opfsManager } from "@/lib/opfs"

export async function zipDirectory(
  dirPaths: string[],
  zip = new JSZip()
): Promise<JSZip> {
  const dirHandle = await getDirHandle(dirPaths)
  for await (let entry of dirHandle.values()) {
    if (entry.kind === "directory") {
      const dirZip = zip.folder(entry.name)
      if (dirZip) {
        await zipDirectory([...dirPaths, entry.name], dirZip)
      }
    }
    if (entry.kind === "file") {
      const file = await (entry as FileSystemFileHandle).getFile()
      const content = await file.arrayBuffer()
      zip.file(entry.name, content, { binary: true })
      continue
    }
  }
  return zip
}

export const zipFile2Blob = async (file: JSZip.JSZipObject) => {
  const content = await file.async("arraybuffer")
  const filename = file.name.split("/").slice(-1)[0]
  return new File([content], filename)
}

export async function importZipFileIntoDir(rootPaths: string[], zip: JSZip) {
  for (let path in zip.files) {
    const entry = zip.files[path]
    if (entry.dir) {
      const dirName = entry.name
        .split("/")
        .filter((i) => i)
        .slice(-1)[0]
      try {
        await opfsManager.addDir(rootPaths, dirName)
      } catch (error) {
        console.warn("import zip file into dir", entry, dirName, error)
      }
    } else {
      const dirPaths = entry.name.split("/").slice(0, -1)
      const p = [...rootPaths, ...dirPaths]
      try {
        const file = await zipFile2Blob(entry)
        await opfsManager.addFile(p, file)
      } catch (error) {
        console.warn("import zip file into dir", entry, p, error)
      }
    }
  }
}
