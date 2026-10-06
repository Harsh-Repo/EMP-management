from django.db.migrations import serializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum
from datetime import date


from .models import Employee, Department, Project
from .serializers import (
    EmployeeSerializer,
    DepartmentSerializer,
    DepartmentDetailSerializer,
    ProjectSerializer,
    ProjectDetailSerializer
)

class EmployeeListCreateView(APIView):

    def get(self, request):
        employees = Employee.objects.all()
        serializer = EmployeeSerializer(employees, many=True)

        return Response(serializer.data)

    def post(self, request):
        serializer = EmployeeSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class EmployeeDetailView(APIView):

    def get_employee(self, employee_id):
        try:
            return Employee.objects.get(id=employee_id)
        except Employee.DoesNotExist:
            return None

    def get(self, request, employee_id):

        employee = self.get_employee(employee_id)

        if employee is None:
            return Response(
                {"error": "Employee not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = EmployeeSerializer(employee)

        return Response(serializer.data)

    def put(self, request, employee_id):

        employee = self.get_employee(employee_id)

        if employee is None:
            return Response(
                {"error": "Employee not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = EmployeeSerializer(
            employee,
            data=request.data
        )

        if serializer.is_valid():
            serializer.save()

            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, employee_id):

        employee = self.get_employee(employee_id)

        if employee is None:
            return Response(
                {"error": "Employee not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        employee.delete()

        return Response(
            {"message": "Employee deleted successfully"},
            status=status.HTTP_204_NO_CONTENT
        )
    
class DepartmentListCreateView(APIView):

    def get(self, request):

        departments = Department.objects.all()

        serializer = DepartmentSerializer(
            departments,
            many=True
        )

        return Response(serializer.data)

    def post(self, request):

        serializer = DepartmentSerializer(
            data=request.data
        )

        if serializer.is_valid():
            serializer.save()

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

class DepartmentDetailView(APIView):

    def get_department(self, department_id):

        try:
            return Department.objects.get(id=department_id)

        except Department.DoesNotExist:
            return None

    def get(self, request, department_id):

        department = self.get_department(department_id)

        if department is None:
            return Response(
                {"error": "Department not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = DepartmentDetailSerializer(
            department
        )

        return Response(serializer.data)

    def put(self, request, department_id):

        department = self.get_department(department_id)

        if department is None:
            return Response(
                {"error": "Department not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = DepartmentSerializer(
            department,
            data=request.data
        )

        if serializer.is_valid():

            serializer.save()

            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, department_id):

        department = self.get_department(department_id)

        if department is None:
            return Response(
                {"error": "Department not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if department.employees.exists():

            return Response(
                {
                    "error": "Cannot delete department because employees exist"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        department.delete()

        return Response(
            {"message": "Department deleted successfully"},
            status=status.HTTP_204_NO_CONTENT
        )

class EmployeeDepartmentView(APIView):

    def get(self, request, employee_id):

        try:
            employee = Employee.objects.select_related(
                "department"
            ).get(id=employee_id)

        except Employee.DoesNotExist:

            return Response(
                {"error": "Employee not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        department = employee.department

        serializer = DepartmentSerializer(department)

        return Response(serializer.data)

class ProjectListCreateView(APIView):

    def get(self, request):

        projects = Project.objects.all()

        serializer = ProjectDetailSerializer(
            projects,
            many=True
        )

        return Response(serializer.data)

    def post(self, request):

        serializer = ProjectSerializer(
            data=request.data
        )

        if serializer.is_valid():

            serializer.save()

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

class ProjectDetailView(APIView):

    def get_project(self, project_id):
        try:
            return Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return None

    def get(self, request, project_id):

        project = self.get_project(project_id)

        if project is None:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ProjectDetailSerializer(project)
        return Response(serializer.data)

    def delete(self, request, project_id):

        project = self.get_project(project_id)

        if project is None:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        if project.end_date >= date.today():
            return Response(
                {
                    "error": "Project cannot be deleted until its end date has passed"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        project.delete()

        return Response(
            {"message": "Project deleted successfully"},
            status=status.HTTP_204_NO_CONTENT
        )


class ProjectAddMemberView(APIView):

    def put(self, request, project_id):

        # Find project
        try:
            project = Project.objects.get(id=project_id)

        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get employee ID from request
        employee_id = request.data.get("employee_id")

        if not employee_id:
            return Response(
                {"error": "employee_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find employee
        try:
            employee = Employee.objects.get(id=employee_id)

        except Employee.DoesNotExist:
            return Response(
                {"error": "Employee not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if employee is already a member
        if project.team.filter(id=employee.id).exists():

            return Response(
                {"error": "Employee is already a project member"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Add employee to project
        project.team.add(employee)

        # Return updated project
        serializer = ProjectDetailSerializer(project)

        return Response(serializer.data)

class ProjectUpdateStatusView(APIView):

    def put(self, request, project_id):

        # Find project
        try:
            project = Project.objects.get(id=project_id)

        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get status from request
        new_status = request.data.get("status")

        if not new_status:
            return Response(
                {"error": "status is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get valid statuses from model choices
        valid_statuses = [
            choice[0]
            for choice in Project.STATUS_CHOICES
        ]

        # Validate status
        if new_status not in valid_statuses:

            return Response(
                {
                    "error": "Invalid status",
                    "valid_statuses": valid_statuses
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update status
        project.status = new_status
        project.save()

        # Return updated project
        serializer = ProjectDetailSerializer(project)

        return Response(serializer.data)


class ProjectBudgetView(APIView):

    def get(self, request, project_id):

        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        employees = project.team.all()

        total_budget = sum(
            employee.salary
            for employee in employees
        )

        return Response({
            "project_id": project.id,
            "project_name": project.name,
            "budget": total_budget
        })

class HighestSalaryView(APIView):

    def get(self, request):

        employee = Employee.objects.order_by("-salary").first()

        if employee is None:
            return Response(
                {"error": "No employees found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = EmployeeSerializer(employee)

        return Response(serializer.data)
    
class SecondHighestSalaryView(APIView):

    def get(self, request):

        departments = Department.objects.all()

        result = []

        for department in departments:

            salaries = list(
                Employee.objects
                .filter(department=department)
                .values_list("salary", flat=True)
                .distinct()
                .order_by("-salary")
            )

            # Department must have at least
            # two different salaries
            if len(salaries) < 2:
                continue

            second_highest_salary = salaries[1]

            employee = Employee.objects.filter(
                department=department,
                salary=second_highest_salary
            ).first()

            result.append({
                "department": department.name,
                "employee": employee.name,
                "salary": employee.salary
            })

        return Response(result)

class SecondHighestSalaryView(APIView):

    def get(self, request):

        departments = Department.objects.all()

        result = []

        for department in departments:

            salaries = list(
                Employee.objects
                .filter(department=department)
                .values_list("salary", flat=True)
                .distinct()
                .order_by("-salary")
            )

            # Department must have at least
            # two different salaries
            if len(salaries) < 2:
                continue

            second_highest_salary = salaries[1]

            employee = Employee.objects.filter(
                department=department,
                salary=second_highest_salary
            ).first()

            result.append({
                "department": department.name,
                "employee": employee.name,
                "salary": employee.salary
            })

        return Response(result)

class DepartmentTotalSalaryView(APIView):

    def get(self, request):

        departments = Department.objects.annotate(
            total_salary=Sum("employees__salary")
        )

        result = []

        for department in departments:

            result.append({
                "department": department.name,
                "total_salary": department.total_salary or 0
            })

        return Response(result)

class ProjectStatusListView(APIView):

    def get(self, request, project_status):

        projects = Project.objects.filter(
            status=project_status
        )

        serializer = ProjectDetailSerializer(
            projects,
            many=True
        )

        return Response(serializer.data)
    