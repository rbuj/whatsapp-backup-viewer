#!/bin/bash

# Corregeix la marca de temps
if [ ! -f "db.old/_chat.txt.bak" ]
then
    sed -i .bak 's/\([0-9]\{1,2\}\/[0-9]\{1,2\}\/[0-9]\{2,4\}\), /\1 /' ./db.old/*.txt
fi

IFS=$'\n'

# per als timestamps dels missatges eliminats
for timestamp in `grep "Aquest missatge s'ha suprimit" db/_chat.txt | sed -n 's/^\(\[[^]]*\]\).*/\1/p'`
do
    # Cerca el timestamp exacte al fitxer antic
    old_line=$(grep -F "$timestamp" db.old/_chat.txt)

    # mostra el canvi
    if [ -n "$old_line" ]; then
        echo "RECUPERAT $timestamp → $old_line"
    else
        echo "NO TROBAT $timestamp"
    fi
done
