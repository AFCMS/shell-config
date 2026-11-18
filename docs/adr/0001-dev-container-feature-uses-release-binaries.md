# Dev Container Feature uses release binaries

Each published Feature pins its installer to the matching GitHub release and carries the SHA-256
checksums of the Linux executables tested by CI. Fetching the appropriate executable at install time
keeps the Feature small and gives it the same installer as a direct download. A Feature version
therefore depends on the availability of the corresponding immutable GitHub release.
