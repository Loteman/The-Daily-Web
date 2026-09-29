import { UserRepository } from '../data/userRepository.js';
import { currentUser } from '../data/api.js';

export class UsersModel {
    constructor(repository = new UserRepository(), getUser = currentUser) {
        this.repository = repository;
        this.getUser = getUser;
        this.users = [];
    }

    getCurrentUser() { return this.getUser(); }

    async load(search = '') {
        this.users = await this.repository.list(search);
        return this.users;
    }

    find(idNumber) {
        const user = this.users.find(item => item.idNumber === idNumber);
        if (!user) throw new Error('המשתמש לא נמצא.');
        return user;
    }

    async save(idNumber, fields) {
        const user = idNumber ? await this.repository.update(idNumber, fields) : await this.repository.create(fields);
        const index = this.users.findIndex(item => item.idNumber === user.idNumber);
        if (index === -1) this.users.push(user); else this.users[index] = user;
        this.users.sort((a, b) => a.username.localeCompare(b.username));
        return user;
    }

    async remove(idNumber) {
        await this.repository.remove(idNumber);
        this.users = this.users.filter(item => item.idNumber !== idNumber);
    }
}
