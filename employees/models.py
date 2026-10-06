# Create your models here.
from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Employee(models.Model):
    name = models.CharField(max_length=100)
    salary = models.FloatField()
    designation = models.CharField(max_length=100)

    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name="employees"
    )

    address = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class Project(models.Model):

    STATUS_CHOICES = [
        ("NEW", "New"),
        ("ON-GOING", "On Going"),
        ("ENDED", "Ended"),
    ]

    name = models.CharField(max_length=100)

    team = models.ManyToManyField(
        Employee,
        related_name="projects",
        blank=True
    )

    team_lead = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        related_name="led_projects"
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="NEW"
    )

    start_date = models.DateField()
    end_date = models.DateField()

    def __str__(self):
        return self.name