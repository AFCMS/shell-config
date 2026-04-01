export async function which(command: string): Promise<string | null> {
  const whichCommand = new Deno.Command("which", {
    args: [command],
    stdin: "null",
    stderr: "piped",
    stdout: "piped",
  });

  const output = await whichCommand.spawn().output();
  const path = new TextDecoder().decode(output.stdout).trim();

  return path || null;
}
