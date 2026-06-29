import sys


def main(email, password, sqlite_path):
    import config
    config.SQLITE_PATH = sqlite_path

    from pgadmin import create_app
    from pgadmin.model import db, Role, User

    app = create_app(config.APP_NAME + "-credential-sync")
    with app.app_context():
        admin_role = Role.query.filter_by(name="Administrator").first()
        if admin_role is None:
            raise RuntimeError("pgAdmin Administrator role is missing")

        user = User.query.filter_by(username=email, auth_source="internal").first()
        if user is None:
            # Create the user directly via the model
            user = User(
                username=email,
                email=email,
                roles=[admin_role],
                active=True,
                auth_source="internal",
            )
            user.password = password
            db.session.add(user)
            action = "created"
        else:
            user.password = password
            user.active = True
            user.locked = False
            action = "updated"

        db.session.commit()
        print(f"pgAdmin user {action}: {email}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("usage: pgadmin-sync-user.py EMAIL PASSWORD SQLITE_PATH")
    main(sys.argv[1], sys.argv[2], sys.argv[3])
