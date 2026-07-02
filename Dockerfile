# php:8.3-apache od razu — Sprint 8 doda backend PHP (REST API) bez zmiany obrazu.
# Na razie Apache serwuje statyczne pliki gry (index.html + /js + /css + /maps).
FROM php:8.3-apache
# rozszerzenia pod MySQL/MariaDB (odkomentować przy Sprint 8):
# RUN docker-php-ext-install pdo pdo_mysql
COPY . /var/www/html/
