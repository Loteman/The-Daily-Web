export class UsersController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.searchTerm = '';
        this.view.bindSearch(value => this.handleSearch(value));
        this.view.bindNewUser(() => this.view.openDialog(null));
        this.view.bindTableActions(id => this.handleEdit(id), id => this.handleDelete(id));
        this.view.bindDialogSubmit((id, fields) => this.handleSave(id, fields));
        this.view.bindDialogClose(() => {});
        this.ready = this.init();
    }

    async init() {
        this.model.getCurrentUser().then(user => this.view.renderScope(user)).catch(() => {});
        await this.load();
    }

    async load() {
        this.view.setLoading(true);
        try {
            const users = await this.model.load(this.searchTerm);
            this.view.renderUsers(users);
            this.view.showLoaded();
        } catch (error) {
            this.view.showError(error);
        } finally {
            this.view.setLoading(false);
        }
    }

    async handleSearch(value) {
        this.searchTerm = value;
        await this.load();
    }

    handleEdit(idNumber) {
        try {
            this.view.openDialog(this.model.find(idNumber));
        } catch (error) {
            this.view.showError(error);
        }
    }

    async handleDelete(idNumber) {
        const user = this.model.find(idNumber);
        if (!window.confirm(`למחוק את המשתמש "${user.username}"? הפעולה בלתי הפיכה.`)) return;
        try {
            await this.model.remove(idNumber);
            this.view.renderUsers(this.model.users);
        } catch (error) {
            this.view.showError(error);
        }
    }

    async handleSave(idNumber, fields) {
        try {
            await this.model.save(idNumber, fields);
            this.view.renderUsers(this.model.users);
            this.view.closeDialog();
        } catch (error) {
            this.view.showDialogError(error.message || 'לא ניתן היה לשמור את המשתמש.');
        }
    }
}
