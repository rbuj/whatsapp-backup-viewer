#!/bin/bash
# fitxers que no estan a la carpeta db però si que estan a la carpeta db.old
diff <(ls db.old | sort) <(ls db | sort) | grep '^<' | sed 's/^< //'