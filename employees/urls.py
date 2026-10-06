from django.urls import path
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .auth_views import CurrentUserView, LogoutView

from .views import (
    # Employee
    EmployeeListCreateView,
    EmployeeDetailView,
    EmployeeDepartmentView,
    HighestSalaryView,
    SecondHighestSalaryView,

    # Department
    DepartmentListCreateView,
    DepartmentDetailView,
    DepartmentTotalSalaryView,

    # Project
    ProjectListCreateView,
    ProjectDetailView,
    ProjectAddMemberView,
    ProjectUpdateStatusView,
    ProjectBudgetView,
    ProjectStatusListView,
)


urlpatterns = [
    path(
        "auth/token/",
        TokenObtainPairView.as_view(permission_classes=[AllowAny]),
        name="token-obtain-pair",
    ),
    path(
        "auth/token/refresh/",
        TokenRefreshView.as_view(permission_classes=[AllowAny]),
        name="token-refresh",
    ),
    path("auth/me/", CurrentUserView.as_view(), name="current-user"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),

    # ==========================================
    # Employee APIs
    # ==========================================

    path(
        "employees/",
        EmployeeListCreateView.as_view(),
        name="employee-list-create"
    ),

    path(
        "employees/highest-salary/",
        HighestSalaryView.as_view(),
        name="employee-highest-salary"
    ),

    path(
        "employees/second-highest-salary/",
        SecondHighestSalaryView.as_view(),
        name="employee-second-highest-salary"
    ),

    path(
        "employees/<int:employee_id>/",
        EmployeeDetailView.as_view(),
        name="employee-detail"
    ),

    path(
        "employees/<int:employee_id>/department/",
        EmployeeDepartmentView.as_view(),
        name="employee-department"
    ),


    # ==========================================
    # Department APIs
    # ==========================================

    path(
        "departments/",
        DepartmentListCreateView.as_view(),
        name="department-list-create"
    ),

    path(
        "departments/total-salary/",
        DepartmentTotalSalaryView.as_view(),
        name="department-total-salary"
    ),

    path(
        "departments/<int:department_id>/",
        DepartmentDetailView.as_view(),
        name="department-detail"
    ),


    # ==========================================
    # Project APIs
    # ==========================================

    path(
        "projects/",
        ProjectListCreateView.as_view(),
        name="project-list-create"
    ),

    path(
        "projects/<int:project_id>/budget/",
        ProjectBudgetView.as_view(),
        name="project-budget"
    ),

    path(
        "projects/<int:project_id>/add-member/",
        ProjectAddMemberView.as_view(),
        name="project-add-member"
    ),

    path(
        "projects/<int:project_id>/update-status/",
        ProjectUpdateStatusView.as_view(),
        name="project-update-status"
    ),

    path(
        "projects/<int:project_id>/",
        ProjectDetailView.as_view(),
        name="project-detail"
    ),

    path(
    "projects/new/",
    ProjectStatusListView.as_view(),
    {"project_status": "NEW"},
    name="project-new"
    ),

    path(
        "projects/on-going/",
        ProjectStatusListView.as_view(),
        {"project_status": "ON-GOING"},
        name="project-on-going"
    ),

    path(
        "projects/ended/",
        ProjectStatusListView.as_view(),
        {"project_status": "ENDED"},
        name="project-ended"
    ),
]