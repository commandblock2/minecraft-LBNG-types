import fs from 'fs/promises'
import path from 'path'
import { execSync, spawnSync } from 'child_process'
import { initGitRepo, sanitizeCommitMessage, validateDirs, applyPatchWithFallback } from './utils'
import readline from 'readline'

async function applyPatchesIterative(patchDir: string, workDir: string) {
    const { absolutePatchDir, absoluteWorkDir } = await validateDirs(patchDir, workDir)

    const hasGitRepo = await fs.access(path.join(absoluteWorkDir, '.git'))
        .then(() => true)
        .catch(() => false)

    if (hasGitRepo) {
        throw new Error('Working directory already contains a git repository')
    }

    await initGitRepo(absoluteWorkDir)

    const patches = (await fs.readdir(absolutePatchDir))
        .filter(file => file.endsWith('.patch'))
        .sort()

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    const askQuestion = (query: string): Promise<string> => {
        return new Promise(resolve => rl.question(query, resolve))
    }

    for (const patch of patches) {
        const patchPath = path.join(absolutePatchDir, patch)
        try {
            const patchContent = await fs.readFile(patchPath, 'utf-8')
            const commitMessage = patchContent
                .split('\n')
                .find(line => line.startsWith('Subject: '))
                ?.replace('Subject: [PATCH] ', '')
                || 'No commit message'

            const sanitizedMessage = sanitizeCommitMessage(commitMessage)

            console.log(`Applying patch: ${patch}`)
            console.log(`Commit message: ${sanitizedMessage}`)

            const success = await applyPatchWithFallback(
                patchPath,
                absoluteWorkDir,
                sanitizedMessage,
                { allowWhitespace: true }
            )
            if (success) {
                console.log(`Successfully applied: ${patch}`)
                continue
            }

            console.error(`Failed to apply patch: ${patch}`)

                const answer = await askQuestion(
                    'Patch failed to apply. Options:\n' +
                    '  [s]kip - Skip this patch and continue\n' +
                    '  [a]bort - Abort the process\n' +
                '  [f]fix - Open shell for manual fixing (exit shell when done)\n' +
                    'Choose an option (s/a/f): '
                )

                if (answer.toLowerCase() === 'a') {
                    console.log('Aborting patch application process')
                    rl.close()
                    return
                } else if (answer.toLowerCase() === 'f') {
                    console.log('Opening shell for manual fixing. Exit the shell when done.')
                    console.log(`Working directory: ${absoluteWorkDir}`)
                    console.log(`Patch file: ${patchPath}`)

                    const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash'
                    spawnSync(shell, [], {
                        cwd: absoluteWorkDir,
                        stdio: 'inherit'
                    })

                    const fixed = await askQuestion('Have you fixed the patch? (y/n): ')

                    if (fixed.toLowerCase() === 'y') {
                        console.log(`Continuing to next patch`)
                    } else {
                        console.log(`Skipping patch: ${patch}`)
                    }
                } else {
                    console.log(`Skipping patch: ${patch}`)
                }
        } catch (error) {
            console.error(`Error processing patch: ${patch}`, error)
            throw error
        }
    }

    rl.close()
    console.log('All patches have been processed.')
}

if (require.main === module) {
    const [patchDir, workDir] = process.argv.slice(2)
    if (!patchDir || !workDir) {
        console.error('Usage: ts-node apply-patches-iterative.ts <patch-dir> <work-dir>')
        process.exit(1)
    }
    applyPatchesIterative(patchDir, workDir).catch(console.error)
}

export { applyPatchesIterative }