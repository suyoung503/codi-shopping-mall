function optionalText(value, max) {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > max) throw new TypeError('Invalid query input');
    return value;
}

function clothesQuery(query) {
    const category = optionalText(query.category, 100);
    const search = optionalText(query.search, 200);
    const conditions = [];
    const values = [];
    if (category) { conditions.push('category = ?'); values.push(category); }
    // LIKE wildcards retain the existing search behavior; the whole pattern is bound as data.
    if (search) { conditions.push('name LIKE ?'); values.push(`%${search}%`); }
    return { sql: 'SELECT * FROM PT' + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : ''), values };
}

function bestClothesQuery(query) {
    const category = optionalText(query.category, 100);
    return {
        sql: 'SELECT * FROM PT' + (category ? ' WHERE category = ?' : '') + ' ORDER BY `like` DESC',
        values: category ? [category] : []
    };
}

module.exports = { clothesQuery, bestClothesQuery };
