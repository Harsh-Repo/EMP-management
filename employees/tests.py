from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase


class AuthenticationAndPermissionTests(APITestCase):
	def setUp(self):
		user_model = get_user_model()
		self.password = "Test-password-123!"
		self.viewer = user_model.objects.create_user(
			username="viewer",
			password=self.password,
		)
		user_model.objects.create_user(
			username="manager",
			password=self.password,
			is_staff=True,
		)

	def token_for(self, username):
		return self.client.post(
			"/auth/token/",
			{"username": username, "password": self.password},
			format="json",
		)

	def test_anonymous_requests_are_rejected(self):
		response = self.client.get("/employees/")

		self.assertEqual(response.status_code, 401)

	def test_authenticated_user_can_read_but_cannot_write(self):
		tokens = self.token_for("viewer")
		self.client.credentials(
			HTTP_AUTHORIZATION=f"Bearer {tokens.data['access']}"
		)

		read_response = self.client.get("/employees/")
		write_response = self.client.post(
			"/departments/",
			{"name": "Design"},
			format="json",
		)

		self.assertEqual(read_response.status_code, 200)
		self.assertEqual(write_response.status_code, 403)

	def test_staff_user_can_write(self):
		tokens = self.token_for("manager")
		self.client.credentials(
			HTTP_AUTHORIZATION=f"Bearer {tokens.data['access']}"
		)

		response = self.client.post(
			"/departments/",
			{"name": "Design"},
			format="json",
		)

		self.assertEqual(response.status_code, 201)

	def test_refresh_rotation_and_logout_revoke_refresh_token(self):
		tokens = self.token_for("viewer")
		self.client.credentials(
			HTTP_AUTHORIZATION=f"Bearer {tokens.data['access']}"
		)
		rotated = self.client.post(
			"/auth/token/refresh/",
			{"refresh": tokens.data["refresh"]},
			format="json",
		)

		self.assertEqual(rotated.status_code, 200)
		self.assertIn("refresh", rotated.data)

		logout = self.client.post(
			"/auth/logout/",
			{"refresh": rotated.data["refresh"]},
			format="json",
		)
		refresh_again = APIClient().post(
			"/auth/token/refresh/",
			{"refresh": rotated.data["refresh"]},
			format="json",
		)

		self.assertEqual(logout.status_code, 204)
		self.assertEqual(refresh_again.status_code, 401)
