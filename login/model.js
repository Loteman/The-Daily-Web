export class LoginModel
{
    constructor()
    {
        this.users = [
            { username: 'admin', password: '123456', role: 'editor' },
            { username: 'admin_creator', password: '123456', role: 'creator' },
            { username: 'admin_editor', password: '123456', role: 'editor' }
        ];
    }

    async validateCredentials(username, password)
    {
        const user = this.users.find(user => user.username === username && user.password === password);
        if (user)
            return { success: true, username: user.username, role: user.role };
        return { success: false, message: 'שם המשתמש או הסיסמה שגויים' };
    }
}
