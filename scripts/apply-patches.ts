// apply-patches.ts
import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import { validateDirs } from './utils'

async function applyPatches(patchDir: string, workDir: string) {
    // Validate directories
    await validateDirs(patchDir, workDir)

    // Check if working directory already contains a git repo
    const hasGitRepo = await fs.access(path.join(workDir, '.git'))
        .then(() => true)
        .catch(() => false)

    if (hasGitRepo) {
        throw new Error('Working directory already contains a git repository')
    }


    // Initialize new git repo
    execSync('git init', { cwd: workDir })
    execSync('git add .', { cwd: workDir })
    execSync('git commit -m "Initial commit"', { cwd: workDir })

    // Get all patch files sorted
    const patches = (await fs.readdir(patchDir))
        .filter(file => file.endsWith('.patch'))
        .sort()

    // Apply each patch
    for (const patch of patches) {
        const patchPath = path.join(patchDir, patch)
        try {
            execSync(`git apply --index "${patchPath}"`, { cwd: workDir })
            execSync('git commit -m "Applied patch: ${patch}"', { cwd: workDir })
        } catch (error) {
            console.error(`Failed to apply patch: ${patch}`)
            throw error
        }
    }
}

if (require.main === module) {
    const [patchDir, workDir] = process.argv.slice(2)
    if (!patchDir || !workDir) {
        console.error('Usage: ts-node apply-patches.ts <patch-dir> <work-dir>')
        process.exit(1)
    }
    applyPatches(patchDir, workDir).catch(console.error)
}
