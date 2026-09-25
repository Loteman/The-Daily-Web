export function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('he-IL');
}
export function showImage(container, source, title = '') {
    if (!container) return;
    container.querySelector('img[data-article-image]')?.remove();
    const placeholder = container.querySelector('svg');
    if (placeholder) placeholder.style.display = '';
    if (typeof source !== 'string' || !/^https?:\/\//i.test(source)) return;
    const image = document.createElement('img');
    image.dataset.articleImage = '';
    image.alt = title;
    image.loading = 'lazy';
    image.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
    image.onload = () => { if (placeholder) placeholder.style.display = 'none'; };
    image.onerror = () => { image.remove(); if (placeholder) placeholder.style.display = ''; };
    image.src = source;
    container.appendChild(image);
}
