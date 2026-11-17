"""Database driver.

On your Windows laptop the project uses mysqlclient. On a Linux host where it cannot be built (such as Render),
or when DB_DRIVER=pymysql is set, the pure-Python PyMySQL is used instead. Both talk to MySQL and TiDB the same way.
"""

import os

try:
    if os.environ.get('DB_DRIVER') == 'pymysql':
        raise ImportError
    import MySQLdb  # noqa: F401
except ImportError:
    import pymysql

    pymysql.install_as_MySQLdb()
