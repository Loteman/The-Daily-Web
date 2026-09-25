const $ = selector => document.querySelector(selector);

function cellText(value) {
    const element = document.createElement('span');
    element.textContent = value ?? '';
    return element.innerHTML;
}

const roleLabel = { reporter: 'כתב', editor: 'עורך' };

export class UsersView {
    getSearch() { return $('#search').value.trim(); }

    renderScope(user) {
        $('#scope').textContent = user ? `מחובר/ת כ-${user.fullName || user.username} (עורך)` : 'ניהול משתמשים';
    }

    setLoading(loading) {
        for (const selector of ['#search', '#new-user']) $(selector).disabled = loading;
        $('.loading-spinner').hidden = !loading;
        if (loading) $('#message').textContent = '';
    }

    showLoaded() {
        $('#dashboard').hidden = false;
        $('.loading-spinner').hidden = true;
        $('#message').textContent = '';
    }

    showError(error) {
        $('.loading-spinner').hidden = true;
        $('#message').textContent = error.status === 403
            ? 'רק עורך יכול לנהל משתמשים.'
            : (error.message || 'לא ניתן לטעון את הנתונים.');
    }

    renderUsers(users) {
        const body = $('#users-table');
        body.replaceChildren();
        if (!users.length) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#64748b">לא נמצאו משתמשים</td></tr>';
            return;
        }
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cellText(user.username)}</td>
                <td>${cellText(user.fullName)}</td>
                <td><span class="role-badge ${user.role}">${roleLabel[user.role] || user.role}</span></td>
                <td>
                    <div class="row-actions">
                        <button type="button" class="edit-btn" data-id="${cellText(user.idNumber)}">עריכה</button>
                        <button type="button" class="delete-btn" data-id="${cellText(user.idNumber)}">מחיקה</button>
                    </div>
                </td>`;
            body.appendChild(tr);
        });
    }

    openDialog(user) {
        const dialog = $('.user-dialog');
        const form = $('#user-form');
        form.reset();
        this.editingId = user?.idNumber || null;
        $('.dialog-title').textContent = user ? 'עריכת משתמש' : 'משתמש חדש';
        form.elements.username.value = user?.username || '';
        form.elements.username.readOnly = Boolean(user);
        form.elements.fullName.value = user?.fullName || '';
        form.elements.role.value = user?.role || 'reporter';
        form.elements.password.value = '';
        form.elements.password.required = !user;
        $('.password-hint').textContent = user ? '(השאירו ריק כדי לא לשנות)' : '';
        $('.dialog-message').textContent = '';
        dialog.showModal();
    }

    closeDialog() { $('.user-dialog').close(); }

    showDialogError(message) { $('.dialog-message').textContent = message; }

    bindSearch(handler) {
        $('#search').addEventListener('input', event => handler(event.target.value));
    }

    bindNewUser(handler) {
        $('#new-user').addEventListener('click', () => handler());
    }

    bindTableActions(onEdit, onDelete) {
        $('#users-table').addEventListener('click', event => {
            const editBtn = event.target.closest('.edit-btn');
            const deleteBtn = event.target.closest('.delete-btn');
            if (editBtn) onEdit(editBtn.dataset.id);
            else if (deleteBtn) onDelete(deleteBtn.dataset.id);
        });
    }

    bindDialogClose(handler) {
        $('.close-dialog').addEventListener('click', () => { handler(); this.closeDialog(); });
        $('.user-dialog').addEventListener('cancel', () => handler());
    }

    bindDialogSubmit(handler) {
        $('#user-form').addEventListener('submit', event => {
            event.preventDefault();
            const fields = Object.fromEntries(new FormData(event.target));
            if (!fields.password) delete fields.password;
            handler(this.editingId, fields);
        });
    }
}
