// ==UserScript==
// @name         Weloma Download
// @namespace    https://github.com/xxrxtnxxov
// @updateURL    https://raw.githubusercontent.com/xxrxtnxxov/weloma-download/main/wd.user.js
// @downloadURL  https://raw.githubusercontent.com/xxrxtnxxov/weloma-download/main/wd.user.js
// @version      2.1
// @description  Добавляет кнопку скачивания рядом с каждой главой на сайте weloma.art
// @author       antiQuarianN
// @match        https://weloma.art/*/*
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// ==/UserScript==

(function() {
    'use strict';

    function addDownloadButton() {
        const chapters = document.querySelectorAll('.list-chapters.at-series a');
        chapters.forEach(chapterLink => {
            const liElement = chapterLink.querySelector('li');
            const chapterNameElement = liElement.querySelector('.chapter-name.text-truncate');
            const chapterTimeElement = liElement.querySelector('.chapter-time');

            // Создаем flex-контейнер
            const rowContainer = document.createElement('div');
            rowContainer.style.display = 'flex';
            rowContainer.style.alignItems = 'center';
            rowContainer.style.width = '100%';

            // Создаём кнопку скачивания
            const downloadButton = document.createElement('button');
            downloadButton.style.border = 'none';
            downloadButton.style.background = 'none';
            downloadButton.style.cursor = 'pointer';
            downloadButton.style.marginRight = '10px';
            downloadButton.innerHTML = '<img src="https://raw.githubusercontent.com/xxrxtnxxov/weloma-download/refs/heads/main/dload.png" width="16" height="16" />';

            // Создаём span для отображения прогресса
            const progressSpan = document.createElement('span');
            progressSpan.style.marginRight = '10px';
            progressSpan.style.fontSize = '12px';
            progressSpan.style.color = '#aaa';
            progressSpan.style.display = 'none';

            // Создаём изображение для загрузки (скрыто)
            const loadingImage = document.createElement('img');
            loadingImage.src = 'https://raw.githubusercontent.com/xxrxtnxxov/weloma-download/refs/heads/main/load.gif'; // GIF-анимация
            loadingImage.style.width = '16px';
            loadingImage.style.height = '16px';
            loadingImage.style.display = 'none'; // По умолчанию скрыто

            // Контейнер для текста (глава + время)
            const textContainer = document.createElement('div');
            textContainer.style.display = 'flex';
            textContainer.style.flexDirection = 'column';
            textContainer.style.flex = '1';
            textContainer.style.marginLeft = '5px';
            textContainer.appendChild(chapterNameElement);
            textContainer.appendChild(chapterTimeElement);

            // Добавляем элементы в flex-контейнер
            rowContainer.appendChild(downloadButton);
            rowContainer.appendChild(progressSpan);
            rowContainer.appendChild(loadingImage);
            rowContainer.appendChild(textContainer);

            // Вставляем обновленный блок в liElement
            liElement.innerHTML = '';
            liElement.appendChild(rowContainer);

            // Обработчик клика
            downloadButton.addEventListener('click', async (event) => {
                event.preventDefault();
                const chapterUrl = chapterLink.href;
                const chapterName = chapterNameElement.textContent.trim();

                console.log(`Начато скачивание главы: ${chapterName}`);

                // Скрываем кнопку, показываем progressSpan
                downloadButton.style.display = 'none';
                progressSpan.style.display = 'inline';
                progressSpan.textContent = '0/?';

                await downloadChapter(chapterUrl, chapterName, progressSpan, downloadButton, loadingImage);
            });
        });
    }

    async function downloadChapter(url, chapterName, progressSpan, downloadButton, loadingImage) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);

            const htmlText = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');

            const images = doc.querySelectorAll('.chapter-content img.chapter-img');
            const imageUrls = Array.from(images).map(img => img.getAttribute('data-src'));
            progressSpan.textContent = `0/${imageUrls.length}`;

            const zip = new JSZip();
            const chapterFolder = zip.folder(chapterName);
            const imageBlobs = await loadImages(imageUrls, progressSpan, loadingImage);

            imageBlobs.forEach((blob, index) => {
                const fileName = `00${index + 1}`.slice(-3) + '.jpg';
                chapterFolder.file(fileName, blob);
            });

            console.log(`Создание архива для главы: ${chapterName}`);

            // Показываем анимацию загрузки
            progressSpan.style.display = 'none';
            loadingImage.style.display = 'inline';

            const content = await zip.generateAsync({type: 'blob'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `${chapterName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log(`Глава ${chapterName} скачана!`);

            // После скачивания возвращаем кнопку
            setTimeout(() => {
                loadingImage.style.display = 'none';
                downloadButton.style.display = 'inline';
            }, 1000);
        } catch (error) {
            progressSpan.textContent = 'Ошибка!';
            console.error(`Ошибка при скачивании ${chapterName}: ${error.message}`);
            alert(`Ошибка: ${error.message}`);

            // Вернуть кнопку в случае ошибки
            setTimeout(() => {
                progressSpan.style.display = 'none';
                loadingImage.style.display = 'none';
                downloadButton.style.display = 'inline';
            }, 2000);
        }
    }

    function loadImages(imageUrls, progressSpan, loadingImage) {
        return new Promise((resolve, reject) => {
            const imageBlobs = [];
            let loadedCount = 0;

            imageUrls.forEach((imageUrl, index) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: imageUrl,
                    responseType: 'blob',
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            imageBlobs[index] = response.response;
                            loadedCount++;
                            updateProgress(loadedCount, imageUrls.length, progressSpan, loadingImage);
                            if (loadedCount === imageUrls.length) resolve(imageBlobs);
                        } else reject(new Error(`Ошибка загрузки изображения: ${response.status}`));
                    },
                    onerror: (error) => reject(new Error(`Ошибка загрузки: ${error}`))
                });
            });
        });
    }

    function updateProgress(loadedCount, total, progressSpan, loadingImage) {
        progressSpan.textContent = `${loadedCount}/${total}`;
        console.log(`Скачивание: ${loadedCount}/${total}`);

        // Когда скачивание завершено, переключаемся на анимацию
        if (loadedCount === total) {
            progressSpan.style.display = 'none';
            loadingImage.style.display = 'inline';
        }
    }

    window.addEventListener('load', addDownloadButton);
})();
