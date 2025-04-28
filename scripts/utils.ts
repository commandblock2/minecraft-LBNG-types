// utils.ts
import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

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

export async function initGitRepo(workDir: string) {
    // Initialize new git repo
    execSync('git init', { cwd: workDir })
    execSync('git add .', { cwd: workDir })
    execSync('git -c user.name="CI" -c user.email="ci@example.com" commit -m "Initial commit"', { cwd: workDir, stdio: 'ignore' })
}

export async function cleanupGitRepo(workDir: string) {
    await fs.rm(path.join(workDir, '.git'), { recursive: true, force: true })
}

export async function applyPatchWithFallback(
    patchPath: string, 
    workDir: string, 
    commitMessage: string,
    options: { allowWhitespace?: boolean } = {}
): Promise<boolean> {
    try {
        // First try with strict application
        execSync(`git apply --index "${patchPath}"`, { 
            cwd: workDir,
            stdio: 'pipe' // Capture output
        })
        
        execSync(`git -c user.name="CI" -c user.email="ci@example.com" commit -m "${commitMessage}"`, { 
            cwd: workDir,
            encoding: 'utf-8',
            stdio: 'pipe'
        })
        
        return true
    } catch (error) {
        if (options.allowWhitespace) {
            try {
                // Try again with whitespace errors ignored
                execSync(`git apply --index --whitespace=nowarn "${patchPath}"`, { 
                    cwd: workDir,
                    stdio: 'pipe'
                })
                
                execSync(`git -c user.name="CI" -c user.email="ci@example.com" commit -m "${commitMessage}"`, { 
                    cwd: workDir,
                    encoding: 'utf-8',
                    stdio: 'pipe'
                })
                
                console.warn(`Warning: Patch ${path.basename(patchPath)} applied with whitespace warnings`)
                return true
            } catch {
                return false
            }
        }
        return false
    }
}
