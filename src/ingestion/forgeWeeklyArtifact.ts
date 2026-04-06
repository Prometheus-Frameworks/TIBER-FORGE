import { readFile } from 'node:fs/promises';
import { ForgeWeeklyPlayerInput } from '../contracts/football';
import { ValidationError, validateForgeWeeklyPlayerInputArray } from '../contracts/validation';

export async function ingestForgeWeeklyArtifact(artifactPath: string): Promise<ForgeWeeklyPlayerInput[]> {
  let raw: string;
  try {
    raw = await readFile(artifactPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ValidationError('ARTIFACT_READ_FAILED', [message], `Failed to read ForgeWeeklyPlayerInput artifact at path: ${artifactPath}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError('ARTIFACT_INVALID_JSON', [`Artifact at path ${artifactPath} is not valid JSON.`], `Malformed ForgeWeeklyPlayerInput artifact at path: ${artifactPath}.`);
  }

  try {
    return validateForgeWeeklyPlayerInputArray(parsed, 'artifact');
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError('ARTIFACT_INVALID_SHAPE', error.details, `Invalid ForgeWeeklyPlayerInput artifact at path: ${artifactPath}.`);
    }
    throw error;
  }
}
