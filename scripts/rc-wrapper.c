#include <process.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/*
 * Tauri's Windows resource helper invokes Microsoft's rc.exe argument shape.
 * This machine already has GNU windres, so this tiny adapter translates the
 * handful of switches used by embed-resource without touching system paths.
 */
int main(int argc, char **argv) {
    const char *windres = getenv("STASHDOCK_WINDRES");
    const char *input = NULL;
    const char *output = NULL;
    char *translated[512];
    int count = 0;

    if (!windres || !*windres) {
        fputs("rc-wrapper: STASHDOCK_WINDRES is not set\n", stderr);
        return 2;
    }

    translated[count++] = (char *)windres;

    for (int index = 1; index < argc; index++) {
        const char *argument = argv[index];

        if (_stricmp(argument, "/nologo") == 0) {
            continue;
        }

        if (_stricmp(argument, "/fo") == 0 && index + 1 < argc) {
            output = argv[++index];
            continue;
        }

        if (_strnicmp(argument, "/fo", 3) == 0 && strlen(argument) > 3) {
            output = argument + 3;
            continue;
        }

        if ((_stricmp(argument, "/I") == 0 || _stricmp(argument, "/D") == 0) && index + 1 < argc) {
            translated[count++] = _stricmp(argument, "/I") == 0 ? "--include-dir" : "-D";
            translated[count++] = argv[++index];
            continue;
        }

        if (argument[0] == '/' && (argument[1] == 'I' || argument[1] == 'i') && strlen(argument) > 2) {
            translated[count++] = "--include-dir";
            translated[count++] = argv[index] + 2;
            continue;
        }

        if (argument[0] == '/' && (argument[1] == 'D' || argument[1] == 'd') && strlen(argument) > 2) {
            translated[count++] = "-D";
            translated[count++] = argv[index] + 2;
            continue;
        }

        input = argument;
    }

    if (!input || !output) {
        fputs("rc-wrapper: expected an input resource and /fo output path\n", stderr);
        return 2;
    }

    translated[count++] = "--input";
    translated[count++] = (char *)input;
    translated[count++] = "--output";
    translated[count++] = (char *)output;
    translated[count++] = "--output-format=coff";
    translated[count] = NULL;

    return _spawnv(_P_WAIT, windres, (const char *const *)translated);
}
