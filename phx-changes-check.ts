import { Octokit } from "@octokit/core";

const CURRENT_TAG = "v1.7.14";
const CHANGE_TRACKED_DIRECTORY = "assets/";
const TS_OWNER = "tylerbarker";
const TS_REPO = "phoenix_ts";
const PHX_OWNER = "phoenixframework";
const PHX_REPO = "phoenix";
const ISSUE_ASSIGNEES = ["tylerbarker"];

const octokit = new Octokit({ auth: process.env.GH_TOKEN });

const issueTitle = (tag: string) => `Phoenix ${tag} released`;

async function listIssueTitles(owner: string, repo: string): Promise<string[]> {
  try {
    const response = await octokit.request("GET /repos/{owner}/{repo}/issues", {
      owner,
      repo,
    });

    // Filter out PRs if they appear in the issues endpoint
    return response.data
      .filter((issue) => !issue.pull_request)
      .map((issue) => issue.title);
  } catch (error: any) {
    console.error(`Error listing issues: ${error.message}`);
    throw Error(error.message);
  }
}

async function maybeCreateIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  assignees: string[],
  tag: string,
) {
  try {
    const issueTitles = await listIssueTitles(owner, repo);
    const issueNotExists = !issueTitles.includes(title);

    if (issueNotExists) {
      const response = await octokit.request(
        "POST /repos/{owner}/{repo}/issues",
        {
          assignees,
          owner,
          repo,
          title,
          body,
          labels: ["automated"],
        },
      );

      console.info(`Issue created: ${response.data.html_url}`);
    } else {
      console.info(
        `Issue already exists for tag ${tag}. Skipping issue creation.`,
      );
    }
  } catch (error: any) {
    console.error(`Error creating issue: ${error.message}`);
    throw Error(error.message);
  }
}

async function fetchTags(owner: string, repo: string) {
  try {
    const response = await octokit.request("GET /repos/{owner}/{repo}/tags", {
      owner,
      repo,
    });
    return response.data.map((tag) => tag.name);
  } catch (error: any) {
    console.error(`Error fetching tags: ${error.message}`);
    throw Error(error.message);
  }
}

async function fetchDirectoryChanges(
  owner: string,
  repo: string,
  baseTag: string,
  latestTag: string,
  directory: string,
) {
  try {
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/compare/{base}...{head}",
      {
        owner,
        repo,
        base: baseTag,
        head: latestTag,
      },
    );

    if (response && response.data.files) {
      // Filter out changes that are not in the specified directory
      const changesInDirectory = response.data.files.filter((file) =>
        file.filename.startsWith(directory),
      );

      changesInDirectory.forEach((change) =>
        console.info(`${change.filename}: ${change.status}`),
      );

      return changesInDirectory;
    }
  } catch (error: any) {
    console.error(`Error fetching data: ${error.message}`);
    throw Error(error.message);
  }
}

async function checkForNewVersionAndCompare(
  owner: string,
  repo: string,
  currentTag: string,
  directory: string,
) {
  const tags = await fetchTags(owner, repo);
  const latestTag = tags[0];

  console.info(`Current tag: ${currentTag}`);
  console.info(`Latest tag: ${latestTag}`);

  if (currentTag !== latestTag) {
    console.info(`Newer version found. Comparing changes...`);
    const changedFiles = await fetchDirectoryChanges(
      owner,
      repo,
      currentTag,
      latestTag,
      directory,
    );

    if (changedFiles) {
      return { changedFiles, latestTag };
    } else {
      throw Error(
        `Octokit returned undefined changed files for tag ${latestTag}.`,
      );
    }
  } else {
    console.info(`No newer version found. No changed files to compare.`);
    return { changedFiles: [], latestTag };
  }
}

async function main() {
  try {
    const { changedFiles, latestTag } = await checkForNewVersionAndCompare(
      PHX_OWNER,
      PHX_REPO,
      CURRENT_TAG,
      CHANGE_TRACKED_DIRECTORY,
    );
    if (CURRENT_TAG !== latestTag) {
      const title = issueTitle(latestTag);
      let issueBodyItems = changedFiles.map(
        (file) =>
          `- [${(file as any).filename}](${(file as any).blob_url}): ${(file as any).status}`,
      );

      if (!issueBodyItems.length) {
        issueBodyItems.push(
          `No JavaScript changes detected in Phoenix ${latestTag}. Bump version to assure compatibility.`,
        );
      }

      issueBodyItems.unshift(`# Change Overview`);
      const body = issueBodyItems.join("\n");

      await maybeCreateIssue(
        TS_OWNER,
        TS_REPO,
        title,
        body,
        ISSUE_ASSIGNEES,
        latestTag,
      );
    } else {
      console.info("phoenix_ts is up to date.");
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw Error(error.message);
  }
}

main();
