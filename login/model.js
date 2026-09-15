export class LoginModel 
{
    constructor() 
    {
        // נתונים מדומים (בעתיד יוחלף בקריאת fetch לשרת / DB)
        this.validUsername = 'admin';
        this.validPassword = '123456';
    }

    async validateCredentials(username, password) 
    {
        // סימולציה של בדיקה (יכול להיות גם בקשת API אסינכרונית)
        if (username === this.validUsername && password === this.validPassword) 
            return { success: true, message: 'ההתחברות בוצעה בהצלחה!' };
        
        return { success: false, message: 'שם המשתמש או הסיסמה שגויים' };
    }
}