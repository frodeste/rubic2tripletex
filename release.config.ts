import type { Options } from "semantic-release";

/**
 * Semantic Release configuration
 *
 * Uses conventional commits to determine version bumps and generate release notes.
 * Releases are published as GitHub Releases with git tags — no commits are pushed
 * back to main (compatible with branch protection rules).
 *
 * @see https://semantic-release.gitbook.io/semantic-release/usage/configuration
 */
const config: Options = {
	branches: ["main"],
	plugins: [
		[
			"@semantic-release/commit-analyzer",
			{
				preset: "conventionalcommits",
			},
		],
		[
			"@semantic-release/release-notes-generator",
			{
				preset: "conventionalcommits",
				writerOpts: {
					transform: (
						commit: Record<string, unknown> & {
							authorName?: string;
							notes?: Array<{ title: string }>;
						},
					) => {
						// Add author name to commit for richer release notes
						if (commit.authorName) {
							commit.user = commit.authorName;
						}

						// Highlight breaking changes with emoji
						if (commit.notes) {
							for (const note of commit.notes) {
								if (note.title === "BREAKING CHANGE" || note.title === "BREAKING CHANGES") {
									note.title = "🚨 BREAKING CHANGES";
								}
							}
						}

						return commit;
					},
				},
			},
		],
		"@semantic-release/github",
	],
};

export default config;
