import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { sanitizeCommitMessage, validateDirs, cleanupGitRepo } from "./utils";

async function generatePatches(patchDir: string, workDir: string) {
    const { absolutePatchDir, absoluteWorkDir } = await validateDirs(
        patchDir,
        workDir
    );

    if (
        !fs
            .access(path.join(absoluteWorkDir, ".git"))
            .then(() => true)
            .catch(() => false)
    ) {
        throw new Error("Working directory is not a git repository");
    }

    try {
        await fs.rm(absolutePatchDir, { recursive: true, force: true });
        await fs.mkdir(absolutePatchDir, { recursive: true });
        console.log(`Successfully cleared and recreated: ${absolutePatchDir}`);
    } catch (error) {
        console.error(`Failed to clear directory ${absolutePatchDir}:`, error);
        throw error;
    }

    const commits = execSync("git log --format=%H --reverse", {
        cwd: absoluteWorkDir,
    })
        .toString()
        .trim()
        .split("\n")
        .slice(1);
    for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        const commitMessage = execSync(`git log --format=%B -n 1 ${commit}`, {
            cwd: absoluteWorkDir,
        }).toString();

        const sanitizedMessage = sanitizeCommitMessage(commitMessage);
        const patchName = `${String(i + 1).padStart(4, "0")}-${sanitizedMessage}.patch`;
        const patchPath = path.join(absolutePatchDir, patchName);

        const patchContent = execSync(`git format-patch -1 --stdout ${commit}`, {
            cwd: absoluteWorkDir,
        });

        await fs.writeFile(patchPath, patchContent);
    }

    try {
    const initialCommit = execSync("git rev-list --max-parents=0 HEAD", {
        cwd: absoluteWorkDir,
    }).toString().trim();

    execSync(`git checkout ${initialCommit}`, {
        cwd: absoluteWorkDir,
    });

        await cleanupGitRepo(absoluteWorkDir);
    } catch (error) {
        await cleanupGitRepo(absoluteWorkDir).catch(console.error);
        throw error;
    }
}

if (require.main === module) {
    const [patchDir, workDir] = process.argv.slice(2);
    if (!patchDir || !workDir) {
        console.error("Usage: ts-node generate-patches.ts <patch-dir> <work-dir>");
        process.exit(1);
    }
    generatePatches(patchDir, workDir).catch(console.error);
}

