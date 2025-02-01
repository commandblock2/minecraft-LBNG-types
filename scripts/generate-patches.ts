import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import { validateDirs } from './utils'

async function generatePatches(patchDir: string, workDir: string) {
    // Validate directories
    await validateDirs(patchDir, workDir)

    // Check if git repo exists
    if (!fs.access(path.join(workDir, '.git')).then(() => true).catch(() => false)) {
        throw new Error('Working directory is not a git repository')
    }

    // Clear existing patches
    const existingPatches = await fs.readdir(patchDir)
    for (const patch of existingPatches) {
        if (patch.endsWith('.patch')) {
            await fs.unlink(path.join(patchDir, patch))
        }
    }

    // Get all commit hashes after initial commit
    const commits = execSync('git log --format=%H --reverse', { cwd: workDir })
        .toString()
        .trim()
        .split('\n')
        .slice(1) // Skip initial commit

    // Generate patch for each commit
    for (let i = 0; i < commits.length; i++) {
        const commit = commits[i]
        const patchName = `${String(i + 1).padStart(4, '0')}.patch`
        const patchPath = path.join(patchDir, patchName)

        const patchContent = execSync(
            `git format-patch -1 --stdout ${commit}`,
            { cwd: workDir }
        )

        await fs.writeFile(patchPath, patchContent)
    }

    // Clean up by removing the git repo
    await fs.rm(path.join(workDir, '.git'), { recursive: true, force: true })
}

if (require.main === module) {
    const [patchDir, workDir] = process.argv.slice(2)
    if (!patchDir || !workDir) {
        console.error('Usage: ts-node generate-patches.ts <patch-dir> <work-dir>')
        process.exit(1)
    }
    generatePatches(patchDir, workDir).catch(console.error)
}

if (require.main === module) {
    const [patchDir, workDir] = process.argv.slice(2)
    if (!patchDir || !workDir) {
        console.error('Usage: ts-node generate-patches.ts <patch-dir> <work-dir>')
        process.exit(1)
    }
    generatePatches(patchDir, workDir).catch(console.error)
}
