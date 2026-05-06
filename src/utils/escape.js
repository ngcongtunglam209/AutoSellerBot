/**
 * Escape utility cho Telegram Markdown v1 (legacy parse_mode: 'Markdown')
 *
 * Trong Markdown v1:
 *   - `code`  → backtick kết thúc code span sớm nếu content có backtick
 *   - *bold*  → asterisk bên trong text thường gây lỗi unclosed entity
 *   - _italic_ → underscore bên trong text thường gây lỗi unclosed entity
 *
 * Hàm safeMd() dùng để escape user-controlled content (login, password,
 * note, username...) trước khi nhúng vào Markdown message.
 */

/**
 * Escape ký tự đặc biệt Markdown v1 trong dữ liệu do user cung cấp.
 * Thay thế bằng ký tự Unicode tương đương để vẫn đọc được.
 *
 * @param {*} str
 * @returns {string}
 */
function safeMd(str) {
  return String(str ?? '')
    .replace(/`/g, "'")       // backtick → dấu nháy đơn (tránh đứt code span)
    .replace(/\*/g, '∗')     // asterisk → dấu nhân unicode (tránh bold unclosed)
    .replace(/_/g, '﹏')     // underscore → dấu gạch dưới unicode (tránh italic unclosed)
    .replace(/\[/g, '(')     // dấu [ → ( (tránh link entity)
    .replace(/\]/g, ')');    // dấu ] → )
}

module.exports = { safeMd };
