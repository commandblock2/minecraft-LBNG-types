// utils.ts
import fs from 'fs/promises'
import path from 'path'

export async function validateDirs(patchDir: string, workDir: string) {
    // Ensure absolute paths
    const absolutePatchDir = path.resolve(patchDir)
    const absoluteWorkDir = path.resolve(workDir)

    // Check if directories exist
    await fs.access(absolutePatchDir).catch(() => {
        throw new Error('Patch directory does not exist')
    })

    await fs.access(absoluteWorkDir).catch(() => {
        throw new Error('Working directory does not exist')
    })

    // Validate they are different directories
    if (absolutePatchDir === absoluteWorkDir) {
        throw new Error('Patch directory and working directory must be different')
    }

    return { absolutePatchDir, absoluteWorkDir }
}


export function sanitizeCommitMessage(message: string): string {
    return message
        .trim()
        // Take first line of commit message
        .split('\n')[0]
        // Remove special characters and spaces
        .replace(/[^a-zA-Z0-9-]/g, '-')
        // Convert to lowercase
        .toLowerCase()
        // Remove consecutive dashes
        .replace(/-+/g, '-')
        // Trim dashes from start and end
        .replace(/^-+|-+$/g, '')
        // Limit length
        .slice(0, 50);
}
