export async function runInlineScript(
  script: string,
  env?: Record<string, string>,
): Promise<void> {
  const tempFilePath = await Deno.makeTempFile({ suffix: ".sh" });
  await Deno.writeTextFile(tempFilePath, script);

  const commandEnv = env ? { ...Deno.env.toObject(), ...env } : undefined;

  const command = new Deno.Command("sh", {
    args: [tempFilePath],
    stdin: "null",
    stderr: "inherit",
    stdout: "inherit",
    env: commandEnv,
  });
  await command.spawn().output().catch((err) => {
    console.error("Error executing script:", err);
  });

  await Deno.remove(tempFilePath);
}
