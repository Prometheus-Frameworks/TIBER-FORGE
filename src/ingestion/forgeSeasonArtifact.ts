import { readFile } from 'node:fs/promises';
import { ForgeSeasonPlayerInputV1 } from '../contracts/football';
import { validateForgeSeasonPlayerInputArray, ValidationError } from '../contracts/validation';

export async function ingestForgeSeasonArtifact(artifactPath: string): Promise<ForgeSeasonPlayerInputV1[]> {
  let raw: string;
  try {
    raw = await readFile(artifactPath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ValidationError('SEASON_ARTIFACT_READ_FAILED', [message], `Failed to read ForgeSeasonPlayerInput artifact at path: ${artifactPath}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError('SEASON_ARTIFACT_INVALID_JSON', [`Artifact at path ${artifactPath} is not valid JSON.`], `Malformed ForgeSeasonPlayerInput artifact at path: ${artifactPath}.`);
  }

  try {
    return validateForgeSeasonPlayerInputArray(parsed, 'seasonArtifact');
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError('SEASON_ARTIFACT_INVALID_SHAPE', error.details, `Invalid ForgeSeasonPlayerInput artifact at path: ${artifactPath}.`);
    }
    throw error;
  }
}
