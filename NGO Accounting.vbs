Dim scriptDir, oShell
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
Set oShell = CreateObject("WScript.Shell")
oShell.Run "pythonw.exe """ & scriptDir & "launch.py""", 0, False
