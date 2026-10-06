from rest_framework import serializers
from .models import Employee, Department, Project


class EmployeeSerializer(serializers.ModelSerializer):

    class Meta:
        model = Employee
        fields = [
            "id",
            "name",
            "salary",
            "designation",
            "department",
            "address",
        ]


class DepartmentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Department
        fields = [
            "id",
            "name",
        ]


class DepartmentDetailSerializer(serializers.ModelSerializer):

    employees = EmployeeSerializer(many=True, read_only=True)

    class Meta:
        model = Department
        fields = [
            "id",
            "name",
            "employees",
        ]

class ProjectSerializer(serializers.ModelSerializer):

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "team",
            "team_lead",
            "status",
            "start_date",
            "end_date",
        ]

        
class ProjectDetailSerializer(serializers.ModelSerializer):

    team = EmployeeSerializer(
        many=True,
        read_only=True
    )

    team_lead = EmployeeSerializer(
        read_only=True
    )

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "team",
            "team_lead",
            "status",
            "start_date",
            "end_date",
        ]
