const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');
const path = require('path');

// Get current git commit info
router.get('/', (req, res) => {
    // First, try to read from environment variables (Docker build)
    const envCommit = process.env.GIT_COMMIT;
    const envCommitFull = process.env.GIT_COMMIT_FULL;

    if (envCommit && envCommit !== 'unknown') {
        return res.json({
            commit: envCommit,
            commitFull: envCommitFull || envCommit,
            source: 'env'
        });
    }

    // Fallback: try to read from git directly (local development)
    try {
        const cwd = path.join(__dirname, '..', '..');

        // Get short commit hash
        const commitHash = execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf8' }).trim();

        // Get full commit hash
        const commitHashFull = execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();

        res.json({
            commit: commitHash,
            commitFull: commitHashFull,
            source: 'git'
        });
    } catch (error) {
        // If git is not available or not a git repo, return empty
        res.json({
            commit: null,
            commitFull: null,
            source: null,
            error: 'Git info not available'
        });
    }
});

module.exports = router;
