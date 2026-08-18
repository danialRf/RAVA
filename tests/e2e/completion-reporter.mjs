import { writeFileSync } from "node:fs";

export default class CompletionReporter {
  onEnd(result) {
    const completionFile = process.env.RAVA_E2E_COMPLETION_FILE;
    if (!completionFile) return;

    writeFileSync(
      completionFile,
      JSON.stringify({ status: result.status }),
      "utf8",
    );
  }
}
