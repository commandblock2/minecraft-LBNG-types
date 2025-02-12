import fs from 'fs/promises'
import path from 'path'
import { sanitizeCommitMessage, validateDirs, initGitRepo, cleanupGitRepo, applyPatchWithFallback } from './utils'
async function applyPatches(patchDir: string, workDir: string) {
    const { absolutePatchDir, absoluteWorkDir } = await validateDirs(patchDir, workDir)

    const hasGitRepo = await fs.access(path.join(absoluteWorkDir, '.git'))
        .then(() => true)
        .catch(() => false)

    if (hasGitRepo) {
        throw new Error('Working directory already contains a git repository')
    }

    try {
        await initGitRepo(absoluteWorkDir)

        const patches = (await fs.readdir(absolutePatchDir))
            .filter(file => file.endsWith('.patch'))
            .sort()

        for (const patch of patches) {
            const patchPath = path.join(absolutePatchDir, patch)
            const patchContent = await fs.readFile(patchPath, 'utf-8')
            const commitMessage = patchContent
                .split('\n')
                .find(line => line.startsWith('Subject: '))
                ?.replace('Subject: [PATCH] ', '')
                || 'No commit message'

            const sanitizedMessage = sanitizeCommitMessage(commitMessage)

            const success = await applyPatchWithFallback(
                patchPath,
                absoluteWorkDir,
                sanitizedMessage,
                { allowWhitespace: true }
            )

            if (!success) {
                const message = `Failed to apply patch: ${patch}, please use \`apply-patches-interative\` instead.`;
                console.error(message)
                await cleanupGitRepo(absoluteWorkDir)
                throw new Error(message)
            }
        }
    } catch (error) {
        await cleanupGitRepo(absoluteWorkDir).catch(console.error)
        throw error
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