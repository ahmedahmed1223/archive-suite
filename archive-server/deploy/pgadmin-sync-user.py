import sys

import config


def main(email, password, sqlite_path):
    config.SQLITE_PATH = sqlite_path

    from pgadmin import create_app
    from pgadmin.model import Role, User
    from pgadmin.tools.user_management import create_user, update_user
    from pgadmin.utils.constants import INTERNAL

    app = create_app(config.APP_NAME + "-credential-sync")
    with app.app_context():
        admin_role = Role.query.filter_by(name="Administrator").first()
        if admin_role is None:
            raise RuntimeError("pgAdmin Administrator role is missing")

        user = User.query.filter_by(username=email, auth_source=INTERNAL).first()
        if user is None:
            ok, message = create_user({
                "email": email,
                "role": admin_role.id,
                "active": True,
                "auth_source": INTERNAL,
                "newPassword": password,
                "confirmPassword": password,
            })
            action = "created"
        else:
            ok, message = update_user(user.id, {
                "role": admin_role.id,
                "active": True,
                "locked": False,
                "newPassword": password,
                "confirmPassword": password,
            })
            action = "updated"

        if not ok:
            raise RuntimeError(message or "pgAdmin user synchronization failed")
        print(f"pgAdmin user {action}: {email}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("usage: pgadmin-sync-user.py EMAIL PASSWORD SQLITE_PATH")
    main(sys.argv[1], sys.argv[2], sys.argv[3])
