@echo off
setlocal enabledelayedexpansion

for %%f in (*) do (
    set "name=%%f"
    set "lower=!name!"
    rem convert to lowercase
    for %%A in (A B C D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
        set "lower=!lower:%%A=%%A!"
        set "lower=!lower:%%A=%%A!"
        set "lower=!lower:%%A=%%A!"
        set "lower=!lower:%%A=%%A!"
        set "lower=!lower:%%A=%%A!"
        set "lower=!lower:%%A=%%A!"
        set "lower=!lower:%%A=%%A!"
        set "lower=!lower:%%A=%%A!"
    )
    set "lower=!lower:A=a!"
    set "lower=!lower:B=b!"
    set "lower=!lower:C=c!"
    set "lower=!lower:D=d!"
    set "lower=!lower:E=e!"
    set "lower=!lower:F=f!"
    set "lower=!lower:G=g!"
    set "lower=!lower:H=h!"
    set "lower=!lower:I=i!"
    set "lower=!lower:J=j!"
    set "lower=!lower:K=k!"
    set "lower=!lower:L=l!"
    set "lower=!lower:M=m!"
    set "lower=!lower:N=n!"
    set "lower=!lower:O=o!"
    set "lower=!lower:P=p!"
    set "lower=!lower:Q=q!"
    set "lower=!lower:R=r!"
    set "lower=!lower:S=s!"
    set "lower=!lower:T=t!"
    set "lower=!lower:U=u!"
    set "lower=!lower:V=v!"
    set "lower=!lower:W=w!"
    set "lower=!lower:X=x!"
    set "lower=!lower:Y=y!"
    set "lower=!lower:Z=z!"

    if not "!name!"=="!lower!" (
        echo Renaming "!name!" to "!lower!"
        ren "%%f" "!lower!"
    )
)
endlocal