// apply-patches.ts
import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import { sanitizeCommitMessage, validateDirs } from './utils'

async function applyPatches(patchDir: string, workDir: string) {
    // Validate directories
    const { absolutePatchDir, absoluteWorkDir } = await validateDirs(patchDir, workDir)

    // Check if working directory already contains a git repo
    const hasGitRepo = await fs.access(path.join(absoluteWorkDir, '.git'))
        .then(() => true)
        .catch(() => false)

    if (hasGitRepo) {
        throw new Error('Working directory already contains a git repository')
    }


    // Initialize new git repo
    execSync('git init', { cwd: absoluteWorkDir })
    execSync('git add .', { cwd: absoluteWorkDir })
    execSync('git commit -m "Initial commit"', { cwd: absoluteWorkDir })

    // Get all patch files sorted
    const patches = (await fs.readdir(absolutePatchDir))
        .filter(file => file.endsWith('.patch'))
        .sort()

    // Apply each patch
    for (const patch of patches) {
        const patchPath = path.join(absolutePatchDir, patch)
        try {
            // Read the patch file to extract original commit message
            const patchContent = await fs.readFile(patchPath, 'utf-8')
            const commitMessage = patchContent
                .split('\n')
                .find(line => line.startsWith('Subject: '))
                ?.replace('Subject: [PATCH] ', '')
                || 'No commit message'

            const sanitizedMessage = sanitizeCommitMessage(commitMessage)

            execSync(`git apply --index "${patchPath}"`, { cwd: absoluteWorkDir })
            execSync(`git commit -m "${sanitizedMessage}"`, { 
                cwd: absoluteWorkDir,
                encoding: 'utf-8'
            })
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
